// Real-browser Calendar checks against the production preview + lifeos_test API.
// node calendar-check.mjs [width] [theme] [scene] [locale] [reduced]
import { authContext, gotoApp, launch, overflow } from './lib.mjs';

const [width = '1440', theme = 'dark', scene = '', locale = 'ru', reduced = 'no', font = 'current'] = process.argv.slice(2);
const browser = await launch();
const context = await authContext(browser, {
  width: Number(width), height: 900, theme, scene: scene || null,
  reducedMotion: reduced === 'yes' ? 'reduce' : 'no-preference', font,
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const report = { width, theme, scene, locale, reduced, font, checks: {}, stage: {}, errors };
const ok = (name, value, detail) => { report.checks[name] = value ? 'PASS' : `FAIL ${detail === undefined ? '' : JSON.stringify(detail)}`; };

const stageBox = () => page.evaluate(() => {
  const s = document.querySelector('.cal-stage');
  if (!s) return null;
  const r = s.getBoundingClientRect();
  return { w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, level: s.dataset.level, layout: s.dataset.layout || null };
});
const active = () => page.evaluate(() => {
  const a = document.activeElement;
  return a ? { tag: a.tagName, cls: a.className, date: a.dataset.date || null, year: a.dataset.year || null, month: a.dataset.month || null, id: a.id || null, label: a.getAttribute('aria-label') } : null;
});
const hash = () => page.evaluate(() => location.hash);
const settle = () => page.waitForTimeout(80);

await gotoApp(page, '#/calendar/2026-10', { locale });
await page.waitForSelector('.cal-stage');

// 1 · stage geometry across levels and layouts
const hashes = ['#/calendar/years', '#/calendar/2026', '#/calendar/2026-10', '#/calendar/2026-08', '#/calendar/2026-10-01', '#/calendar/history'];
for (const layout of ['B', 'A']) {
  if (layout === 'A') {
    await page.evaluate(() => { location.hash = '#/calendar/2026-10'; });
    await settle();
    await page.locator('.cal-seg-btn', { hasText: 'A' }).first().click();
    await settle();
  }
  for (const h of hashes) {
    await page.evaluate(v => { location.hash = v; }, h);
    await page.waitForTimeout(120);
    report.stage[`${layout}:${h}`] = await stageBox();
  }
}
const boxes = Object.values(report.stage).filter(Boolean);
const widths = new Set(boxes.map(b => b.w));
const heights = new Set(boxes.map(b => b.h));
const expectH = Number(width) >= 1024 ? 620 : Number(width) >= 768 ? 560 : null;
ok('stage width stable across levels/layouts', widths.size === 1, [...widths]);
if (expectH) ok(`stage height ${expectH}`, heights.size === 1 && heights.has(expectH), [...heights]);
else ok('phone stage is auto height (varies with content)', heights.size > 1, [...heights]);
report.overflow = await overflow(page);
ok('no document horizontal overflow', report.overflow.doc === 0, report.overflow);

// back to B for the flow
await page.evaluate(() => { location.hash = '#/calendar/2026-10'; });
await settle();
await page.locator('.cal-seg-btn', { hasText: 'B' }).first().click();
await settle();
ok('B pressed after switch', await page.locator('.cal-seg-btn[aria-pressed="true"]', { hasText: 'B' }).count() === 1);
const bFocus = await active();
ok('layout switch keeps focus on the pressed layout button', bFocus && String(bFocus.label || '').startsWith('B ·'), bFocus);
ok('layout switch keeps the route', (await hash()) === '#/calendar/2026-10', await hash());
ok('the selected day stays selected in B', await page.locator('.cal-stage [data-date="2026-10-01"][data-autofocus="1"]').count() === 1);
/* from a tile, keyboard navigation hands focus to the next level's tile */
await page.locator('.cal-stage [data-date="2026-10-01"]').focus();

// 2 · Escape chain + focus: days → months → years
await page.keyboard.press('Escape');
await settle();
ok('Escape: days → months', (await hash()) === '#/calendar/2026', await hash());
let a = await active();
ok('months focus: selected month', a && a.month === '2026-10', a);
await page.keyboard.press('Escape');
await settle();
ok('Escape: months → years', (await hash()) === '#/calendar/years/2026', await hash());
a = await active();
ok('years focus: selected year', a && a.year === '2026', a);
ok('scroll not moved by focus', (await page.evaluate(() => window.scrollY)) === 0, await page.evaluate(() => window.scrollY));

// 3 · arrows on the 12 grid follow rendered columns
const cols = await page.evaluate(() => {
  const tiles = [...document.querySelectorAll('.cal-grid-years [data-tile]')];
  return tiles.filter(t => Math.abs(t.offsetTop - tiles[0].offsetTop) < 2).length;
});
await page.keyboard.press('ArrowDown');
a = await active();
ok(`ArrowDown moves one rendered row (${cols} columns)`, a && Number(a.year) === 2026 + cols, a);
await page.keyboard.press('ArrowRight');
a = await active();
ok('ArrowRight moves one tile', a && Number(a.year) === 2027 + cols, a);
await page.keyboard.press('Enter');
await settle();
ok('Enter on a year opens its months', (await hash()) === `#/calendar/${2027 + cols}`, await hash());
a = await active();
ok('months of that year focus the clamped selected month', a && a.month === `${2027 + cols}-10`, a);

// 4 · breadcrumbs: root crumb → years, then year tile/month tile to Aug 2026 (6 weeks)
await page.locator('.cal-crumb[data-level="years"]').click();
await settle();
ok('root breadcrumb opens years', (await hash()).startsWith('#/calendar/years/'), await hash());
await page.evaluate(() => { location.hash = '#/calendar/2026'; });
await settle();
await page.locator('[data-month="2026-08"]').click();
await settle();
ok('month tile opens its days', (await hash()) === '#/calendar/2026-08', await hash());
ok('Aug 2026 has 6 week panels in B', (await page.locator('.cal-week').count()) === 6, await page.locator('.cal-week').count());

// 5 · B arrows: ↓ stays in the week, → same weekday next panel, edges safe
await page.locator('[data-date="2026-08-02"]').focus(); // Sunday, end of week 1
await page.keyboard.press('ArrowDown');
a = await active();
ok('B: ArrowDown at Sunday stays in its week panel', a && a.date === '2026-08-02', a);
await page.keyboard.press('ArrowRight');
a = await active();
ok('B: ArrowRight → same weekday of the next week', a && a.date === '2026-08-09', a);
await page.keyboard.press('ArrowUp');
a = await active();
ok('B: ArrowUp inside the week', a && a.date === '2026-08-08', a);
await page.locator('[data-date="2026-07-27"]').focus(); // first row of first panel
await page.keyboard.press('ArrowLeft');
a = await active();
ok('B: ArrowLeft at the first panel stays', a && a.date === '2026-07-27', a);

// 6 · A arrows follow the 7-column geometry
await page.locator('.cal-seg-btn', { hasText: 'A' }).first().click();
await settle();
await page.locator('[data-date="2026-08-12"]').focus();
await page.keyboard.press('ArrowDown');
a = await active();
ok('A: ArrowDown = same weekday next row', a && a.date === '2026-08-19', a);
await page.keyboard.press('ArrowLeft');
a = await active();
ok('A: ArrowLeft = previous day', a && a.date === '2026-08-18', a);
await page.locator('.cal-seg-btn', { hasText: 'B' }).first().click();
await settle();

// 7 · clamping: select 31 Aug, go to September via next → 30 Sep selected
await page.locator('[data-date="2026-08-31"]').click();
await settle();
ok('day tile opens day details', (await hash()) === '#/calendar/2026-08-31', await hash());
a = await active();
ok('day details focus the day heading', a && a.id === 'cal-day-title', a);
await page.keyboard.press('Escape');
await settle();
ok('Escape: day → days', (await hash()) === '#/calendar/2026-08', await hash());
a = await active();
ok('days focus the selected 31 Aug', a && a.date === '2026-08-31', a);
await page.locator('.cal-seg-btn.is-icon').nth(1).click();
await settle();
ok('next month', (await hash()) === '#/calendar/2026-09', await hash());
ok('31 Aug clamps to 30 Sep in the next month', await page.locator('.cal-stage [data-date="2026-09-30"][data-autofocus="1"]').count() === 1);
a = await active();
ok('«next month» keeps focus (repeatable)', a && String(a.cls).includes('is-icon'), a);
await page.locator('.cal-stage [data-date="2026-09-30"]').focus();

// 8 · Back / Forward
await page.goBack();
await page.waitForTimeout(150);
ok('Back returns to August', (await hash()) === '#/calendar/2026-08', await hash());
a = await active();
ok('Back focuses a tile of the restored view', a && typeof a.date === 'string' && a.date.startsWith('2026-08'), a);
await page.goForward();
await page.waitForTimeout(150);
ok('Forward returns to September', (await hash()) === '#/calendar/2026-09', await hash());

// 9 · reload keeps the level (deep link)
await page.evaluate(() => { location.hash = '#/calendar/2026-10-01'; });
await settle();
await page.reload();
await page.waitForSelector('.cal-stage[data-level="day"]');
await page.waitForTimeout(300);
ok('reload/deep link opens day details', (await page.locator('.cal-stage').getAttribute('data-level')) === 'day');
report.initialFocus = await active();
ok('arrival does not steal focus', !report.initialFocus || !String(report.initialFocus.cls).includes('cal-'), report.initialFocus);

// 10 · editor: Escape closes only the editor, focus returns, level stays
const row = page.locator('.cal-task').first();
if (await row.count()) {
  await row.locator('.cal-act', { hasText: /изменить|змінити/ }).click();
  await page.waitForSelector('.cal-editor');
  await page.waitForTimeout(80);
  await page.keyboard.press('Escape');
  await settle();
  ok('Escape closes only the editor', (await page.locator('.cal-editor').count()) === 0 && (await hash()) === '#/calendar/2026-10-01', await hash());
  a = await active();
  ok('focus returns to the edit button', a && String(a.cls).includes('cal-act'), a);
  // delete confirmation: Escape cancels it first
  await row.locator('[data-delete]').click();
  ok('delete asks for confirmation', (await page.locator('.cal-confirm').count()) === 1);
  await page.keyboard.press('Escape');
  await settle();
  ok('Escape cancels the confirmation first (still on the day)', (await page.locator('.cal-confirm').count()) === 0 && (await hash()) === '#/calendar/2026-10-01', await hash());
  a = await active();
  ok('focus back on the delete button', a && String(a.cls).includes('is-danger'), a);
  // Escape with focus on <body> still goes one level up
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.keyboard.press('Escape');
  await settle();
  ok('Escape from <body> goes up a level', (await hash()) === '#/calendar/2026-10', await hash());
  await page.evaluate(() => { location.hash = '#/calendar/2026-10-01'; });
  await settle();
}

// 11 · motion: navigation restarts the tile animation (or the reduced fade)
await page.locator('.cal-crumb[data-level="days"]').click();
await page.waitForTimeout(30);
report.animation = await page.evaluate(() => {
  const tile = document.querySelector('.cal-grid [data-tile], .cal-grid .cal-tile');
  const el = tile && (tile.closest('.cal-tile') || tile);
  return el ? getComputedStyle(el).animationName : null;
});
ok(reduced === 'yes' ? 'reduced motion uses the fade' : 'navigation spins the tiles', reduced === 'yes' ? /cal-fade/.test(report.animation) : /cal-spin/.test(report.animation), report.animation);

report.overflowEnd = await overflow(page);
ok('no overflow at the end', report.overflowEnd.doc === 0, report.overflowEnd);
report.summary = Object.values(report.checks).every(v => v === 'PASS') && errors.length === 0 ? 'ALL PASS' : 'HAS FAILURES';
console.log(JSON.stringify(report, null, 1));
await browser.close();
