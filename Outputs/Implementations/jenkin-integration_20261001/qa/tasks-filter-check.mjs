// Drives the real Tasks filter <select>: every option's count must equal the rows it shows.
import { authContext, gotoApp, launch, overflow } from './lib.mjs';

const [width = '1440', theme = 'dark', scene = '', locale = 'ru'] = process.argv.slice(2);
const browser = await launch();
const context = await authContext(browser, { width: Number(width), height: 900, theme, scene: scene || null });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await gotoApp(page, '#/tasks', { locale });
await page.waitForSelector('.tasks-filter-select');
const options = await page.$$eval('.tasks-filter-select option', os => os.map(o => ({ value: o.value, text: o.textContent })));
const results = [];
for (const o of options) {
  await page.selectOption('.tasks-filter-select', o.value);
  await page.waitForTimeout(120);
  const claimed = Number(o.text.split('·').pop().trim());
  let shown;
  if (o.value === 'waiting') shown = await page.locator('.waiting-list:not(.is-closed) .waiting-row').count();
  else shown = await page.locator('.task-list .task-row').count();
  const sort = await page.locator('.tasks-sort-trigger').innerText();
  results.push({ value: o.value, text: o.text, claimed, shown, ok: claimed === shown, sort });
}
const typo = await page.evaluate(() => {
  const title = document.querySelector('.tasks-page .task-title-btn');
  const due = document.querySelector('.tasks-page .task-due');
  const cs = el => el && getComputedStyle(el);
  return title && due ? { title: [cs(title).fontSize, cs(title).fontWeight], due: [cs(due).fontSize, cs(due).fontWeight] } : null;
});
console.log(JSON.stringify({ width, theme, scene, locale, results, typo, overflow: await overflow(page), errors }, null, 0));
await browser.close();
