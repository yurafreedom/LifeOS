// Real-browser checks for the review findings (production preview + lifeos_test API).
import { authContext, getState, gotoApp, launch } from './lib.mjs';
import { seed } from './seed.mjs';

const results = {};
const ok = (name, value, detail) => { results[name] = value ? 'PASS' : `FAIL ${detail === undefined ? '' : JSON.stringify(detail)}`; };
const seeded = await seed();
const today = seeded.today;
const month = today.slice(0, 7);
const browser = await launch();
const context = await authContext(browser, { width: 1440, height: 900 });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
const hash = () => page.evaluate(() => location.hash);
const tasksJson = async () => JSON.stringify((await getState(context)).payload.tasks);
const active = () => page.evaluate(() => {
  const a = document.activeElement;
  return a ? { cls: String(a.className || ''), date: a.dataset.date || null, month: a.dataset.month || null, label: a.getAttribute('aria-label'), text: a.textContent.trim().slice(0, 30), inDialog: !!a.closest('[role="dialog"]') } : null;
});
const center = async locator => { const b = await locator.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
/* One click event with detail = 2: the second click of a double click. */
const secondClick = async ({ x, y }) => {
  await page.mouse.move(x, y);
  await page.mouse.down({ clickCount: 2 });
  await page.mouse.up({ clickCount: 2 });
};

await gotoApp(page, `#/calendar/${month}`);
await page.waitForSelector('.cal-stage[data-level="days"]');

// 1 · the second click of a double click never acts on what the first one revealed
for (const layout of ['B', 'A']) {
  await page.evaluate(m => { location.hash = `#/calendar/${m}`; }, month);
  await page.waitForSelector('.cal-stage[data-level="days"]');
  await page.locator('.cal-seg-btn', { hasText: layout }).first().click();
  await page.waitForTimeout(700);
  const before = await tasksJson();
  await page.locator(`.cal-stage [data-tile][data-date="${today}"]`).click();
  await page.waitForSelector('.cal-task');
  await page.waitForTimeout(650); // the spin has settled: the revealed controls are fully hittable
  const targets = ['.cal-task .task-check', '.cal-task .cal-act.is-danger', '.cal-task .cal-act', '.cal-add'];
  for (const selector of targets) {
    await secondClick(await center(page.locator(selector).first()));
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(900); // longer than the debounced sync
  ok(`${layout} · detail-2 clicks on the revealed check / close / actions / add change nothing`, (await tasksJson()) === before);
  ok(`${layout} · no dialog or delete confirmation opened by them`, await page.locator('[role="dialog"], [data-confirm-cancel]').count() === 0);
  ok(`${layout} · still on the day`, (await hash()) === `#/calendar/${today}`, await hash());
  /* a real single click still works */
  await page.locator('.cal-task .task-check').first().click();
  let done = false;
  for (let i = 0; i < 40 && !done; i++) { await page.waitForTimeout(200); done = (await tasksJson()) !== before; }
  ok(`${layout} · an ordinary single click still completes the task`, done);
  await seed();
  await page.reload();
  await page.waitForSelector('.cal-stage');
}

// 2 · History: a real double click on Restore restores exactly one task
await page.evaluate(() => { location.hash = '#/calendar/history'; });
await page.waitForSelector('.cal-history-action button, .cal-history button');
await page.waitForTimeout(650);
const rowsBefore = await page.locator('.cal-history tbody tr').count();
const restoreBtn = page.locator('.cal-history tbody tr').first().locator('button').last();
await restoreBtn.dblclick();
await page.waitForTimeout(1200);
const rowsAfter = await page.locator('.cal-history tbody tr').count();
ok('History · a double click on Restore restores exactly one task', rowsAfter === rowsBefore - 1, [rowsBefore, rowsAfter]);
await seed();
await page.reload();
await page.waitForSelector('.cal-stage');

// 3 · toolbar controls keep focus while usable
await page.evaluate(m => { location.hash = `#/calendar/${m}`; }, month);
await page.waitForSelector('.cal-stage[data-level="days"]');
const [y, mo] = month.split('-').map(Number);
const plus = n => { const d = new Date(Date.UTC(y, mo - 1 + n, 1)); return d.toISOString().slice(0, 7); };
await page.locator('.cal-seg[aria-label] .cal-seg-btn.is-icon').last().focus();
await page.keyboard.press('Enter');
await page.waitForTimeout(150);
await page.keyboard.press('Enter');
await page.waitForTimeout(150);
ok('Enter twice on «next month» moves two months', (await hash()) === `#/calendar/${plus(2)}`, await hash());
ok('… and focus stays on «next month»', /is-icon/.test((await active()).cls), await active());
await page.locator('.cal-seg-btn.mono').focus();
await page.keyboard.press('Enter');
await page.waitForTimeout(150);
ok('Today keeps focus', (await active()).cls.includes('cal-seg-btn') && (await active()).cls.includes('mono'), await active());
await page.locator('.cal-seg-btn', { hasText: 'A' }).first().focus();
await page.keyboard.press('Enter');
await page.waitForTimeout(150);
ok('the A/B switch keeps focus and switches', (await active()).label?.startsWith('A ·') && await page.locator('.cal-stage[data-layout="A"]').count() === 1, await active());
await page.locator('.cal-seg-btn', { hasText: 'B' }).first().click();
await page.locator('.cal-history-btn').focus();
await page.keyboard.press('Enter');
await page.waitForTimeout(150);
ok('History keeps focus and opens History', (await active()).cls.includes('cal-history-btn') && (await hash()) === '#/calendar/history', [await active(), await hash()]);
await page.keyboard.press('Enter');
await page.waitForTimeout(150);
ok('History pressed again returns to the month with focus kept', (await active()).cls.includes('cal-history-btn') && (await hash()).startsWith('#/calendar/2'), [await active(), await hash()]);
/* a breadcrumb that becomes the current level hands focus to the stage */
await page.evaluate(d => { location.hash = `#/calendar/${d}`; }, today);
await page.waitForSelector('.cal-task');
await page.locator('.cal-crumb[data-level="months"]').focus();
await page.keyboard.press('Enter');
await page.waitForTimeout(200);
ok('a breadcrumb moves focus to the selected month tile', (await active()).month === String(Number(today.slice(5, 7))) || (await active()).cls.includes('cal-tile'), await active());
/* «next» at the upper bound becomes disabled → focus goes into the stage */
await page.evaluate(() => { location.hash = '#/calendar/2100-11'; });
await page.waitForSelector('.cal-stage[data-level="days"]');
await page.locator('.cal-seg[aria-label] .cal-seg-btn.is-icon').last().focus();
await page.keyboard.press('Enter');
await page.waitForTimeout(200);
ok('«next» that hits its bound hands focus to a tile', (await hash()) === '#/calendar/2100-12' && (await active()).date === '2100-12-01', [await hash(), await active()]);

// 4 · Back with Quick Add open: focus stays in the dialog
await page.evaluate(m => { location.hash = `#/calendar/${m}`; }, month);
await page.waitForSelector('.cal-stage[data-level="days"]');
await page.locator(`.cal-stage [data-tile][data-date="${today}"]`).click();
await page.waitForSelector('.cal-add');
await page.locator('.cal-add').click();
await page.waitForSelector('[role="dialog"]');
await page.waitForTimeout(200);
await page.goBack();
await page.waitForTimeout(400);
ok('Back with Quick Add open leaves focus inside the dialog', (await active()).inDialog && (await hash()) === `#/calendar/${month}`, [await active(), await hash()]);
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
ok('Escape then closes Quick Add only', await page.locator('[role="dialog"]').count() === 0 && (await hash()) === `#/calendar/${month}`);

// 5 · Alt/⌘/Ctrl + arrows are left to the browser
await page.locator(`.cal-stage [data-tile][data-date="${today}"]`).focus();
for (const mod of ['Alt', 'Control', 'Meta']) await page.keyboard.press(`${mod}+ArrowRight`);
ok('modified arrows do not move between tiles', (await active()).date === today, await active());
await page.keyboard.press('ArrowRight');
ok('a plain arrow still moves', (await active()).date !== today, await active());

// 6 · Tasks sort: Escape straight from the trigger
await page.evaluate(() => { location.hash = '#/tasks'; });
await page.waitForSelector('.tasks-sort-trigger');
await page.locator('.tasks-sort-trigger').click();
await page.waitForSelector('.tasks-sort-pop');
await page.keyboard.press('Escape');
await page.waitForTimeout(100);
ok('Escape closes the sort list with focus still on the trigger', await page.locator('.tasks-sort-pop').count() === 0
  && (await active()).cls.includes('tasks-sort-trigger'), await active());
ok('the trigger announces expanded state, not a listbox', await page.locator('.tasks-sort-trigger').getAttribute('aria-haspopup') === null
  && await page.locator('.tasks-sort-trigger').getAttribute('aria-expanded') === 'false');

// 7 · Waiting dialog eyebrow is styled again
await page.selectOption('.tasks-filter-select', 'waiting');
await page.locator('.waiting-open').first().click();
await page.waitForSelector('.cal-dialog-eyebrow');
const eyebrow = await page.$eval('.cal-dialog-eyebrow', el => ({ size: getComputedStyle(el).fontSize, color: getComputedStyle(el).color, fg3: getComputedStyle(document.documentElement).getPropertyValue('--fg3').trim() }));
ok('Waiting dialog eyebrow is 11 px muted (as before the Calendar pass)', eyebrow.size === '11px', eyebrow);
await page.keyboard.press('Escape');
await context.close();

// 8 · Paradise: the History button stays opaque on hover and when pressed
for (const scene of ['day', 'night']) {
  const ctx = await authContext(browser, { width: 1440, height: 900, theme: 'paradise', scene });
  const p = await ctx.newPage();
  await gotoApp(p, `#/calendar/${month}`);
  await p.waitForSelector('.cal-history-btn');
  await p.locator('.cal-history-btn').hover();
  await p.waitForTimeout(250);
  const read = () => p.$eval('.cal-history-btn', el => { const cs = getComputedStyle(el); return { color: cs.backgroundColor, image: cs.backgroundImage }; });
  const alpha = c => { const m = c.match(/rgba?\(([^)]+)\)/); const v = m[1].split(',').map(Number); return v.length > 3 ? v[3] : 1; };
  const hovered = await read();
  ok(`paradise-${scene} · History hover is opaque`, alpha(hovered.color) >= 0.9 && hovered.image.includes('gradient'), hovered);
  await p.locator('.cal-history-btn').click();
  await p.mouse.move(1, 1);
  await p.waitForTimeout(250);
  const pressed = await read();
  ok(`paradise-${scene} · pressed History is opaque`, alpha(pressed.color) >= 0.9 && pressed.image.includes('gradient'), pressed);
  await ctx.close();
}

console.log(JSON.stringify({ today, results, errors }, null, 1));
await browser.close();
