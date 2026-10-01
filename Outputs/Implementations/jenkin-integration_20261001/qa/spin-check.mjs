import { authContext, gotoApp, launch } from './lib.mjs';
const browser = await launch();
const out = [];
for (const [theme, scene] of [['dark', null], ['light', null], ['paradise', 'day'], ['paradise', 'night']]) {
  const context = await authContext(browser, { width: 1440, height: 900, theme, scene });
  const page = await context.newPage();
  await gotoApp(page, '#/calendar/years');
  await page.waitForSelector('.cal-grid-years');
  await page.locator('[data-year="2026"]').click();
  const mid = await page.evaluate(() => new Promise(r => setTimeout(() => {
    const t = document.querySelector('.cal-grid-months .cal-tile');
    r(t ? getComputedStyle(t).transform : null);
  }, 150)));
  await page.waitForTimeout(700);
  const settled = await page.evaluate(() => [...document.querySelectorAll('.cal-grid-months .cal-tile')].map(t => {
    const cs = getComputedStyle(t); const r = t.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { tf: cs.transform, op: cs.opacity, w: Math.round(r.width), hit: !!hit && t.contains(hit) };
  }));
  out.push({ theme, scene, bad: settled.filter(s => !((s.tf === 'none' || s.tf.startsWith('matrix(1, 0, 0, 1, 0,')) && s.op === '1' && s.w > 50 && s.hit)), n: settled.length });
  await context.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
